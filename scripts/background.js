let uid;

let [initStorageRetryLimit, postYouTubeTimeRetryLimit] = Array(4).fill(3);

// Used to target specific tab with the current youtube link
// when executing content script
let currentYouTubeURL;
const youtubeRegex =
  /(https:(.+?\.)?youtube\.com\/watch(\/[A-Za-z0-9\-\._~:\/\?#\[\]@!$&'\(\)\*\+,;\=]*)?)/;

let host = chrome.runtime.connectNative('com.samba.sharehubhost');

// host.postMessage({ text: 'Hello, my_application' });

// The only message the extension will receive from the host
// is a user ID
host.onMessage.addListener(function (msg) {
  console.log('msg from host: ', msg);
  if (msg?.YouTubeURL) {
    getYouTubeTime(msg.YouTubeURL, msg.YouTubeTitle).then((time) => {
      host.postMessage({
        time: time,
      });
    });
  } else {
    setUserID(msg);
  }
});

host.onDisconnect.addListener(function () {
  if (chrome.runtime.lastError) {
    console.log('Host runtime error: ', chrome.runtime.lastError.message);
  }
});

const initStorage = () => {
  try {
    initStorageCache;
  } catch (e) {
    console.log('Storage.sync initialization error: ', e, '\n Retrying...');

    if (initStorageRetryLimit < 3) {
      initStorageRetryLimit++;
      initStorage();
    } else {
      initStorageRetryLimit = 0;
    }
  }
};

var storageListener = (changes, namespace) => {
  console.log('Storage changed: ', changes);
  uid = changes['UserID'];
};

// Asynchronously retrieve data from storage.sync, then cache it.
const initStorageCache = getStorageSyncData()
  .then((data) => {
    // Copy the data retrieved from storage into storageCache.
    uid = data.replace(/['"]+/g, '');
    chrome.storage.onChanged.addListener(storageListener);

    let YouTubeTimeRequestsRef = db
      .collection('Users')
      .doc(data?.replace(/['"]+/g, ''))
      .collection('YouTubeTimeRequests');

    YouTubeTimeRequestsRef.onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          postYouTubeTime();
          YouTubeTimeRequestsRef.doc(change.doc.id).delete();
        }
      });
    });
  })
  .catch(() => {
    chrome.storage.onChanged.addListener(storageListener);
  });

// Reads all data out of storage.sync and exposes it via a promise.
function getStorageSyncData() {
  // Immediately return a promise and start asynchronous work
  return new Promise((resolve, reject) => {
    // Asynchronously fetch all data from storage.sync.
    chrome.storage.sync.get(['UserID'], (result) => {
      // Pass any observed errors down the promise chain.
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      // Pass the data retrieved from storage down the promise chain.
      resolve(result.UserID);
    });
  });
}

function setUserID(id) {
  chrome.storage.sync.set({ UserID: id }, function () {
    console.log('Synced storage data set to: ', id);
  });
}

// function getUserID() {
//   $.ajax({
//     url: 'http://localhost:8080',
//     method: 'GET',
//     contentType: 'text/html',
//     cache: false,
//   })
//     .done((data) => {
//       chrome.storage.sync.set({ UserID: data }, function () {
//         console.log('Synced storage data set to: ', data);
//       });
//     })
//     .fail((jqXHR, textStatus, errorThrown) => {
//       console.log('Error getting user ID: ', errorThrown, '\n Retrying...');
//       getUserID();
//     });
// }

function getYouTubeTime(YouTubeURL, YouTubeTitle) {
  queryInfo = {
    url: YouTubeURL,
    title: YouTubeTitle,
  };

  return new Promise((resolve, reject) => {
    try {
      let time;

      chrome.tabs.query(queryInfo, function (result) {
        chrome.tabs.executeScript(
          result[0].id,
          {
            code: 'document.getElementsByClassName("video-stream")[0].currentTime',
          },
          (results) => {
            resolve(Math.floor(results && results[0]));
          }
        );
      });
    } catch (e) {
      reject(e);
    }
  });
}

function postYouTubeTime() {
  queryInfo = {
    url: currentYouTubeURL,
  };

  chrome.tabs.query(queryInfo, function (result) {
    chrome.tabs.executeScript(
      result[0].id,
      {
        code: 'document.getElementsByClassName("video-stream")[0].currentTime',
      },
      (results) => {
        let time = results && results[0];
        console.log(uid);
        db.collection('Users')
          .doc(uid)
          .collection('Activity')
          .doc('YouTube')
          .set({ YouTubeTime: time }, { merge: true })
          .then(() => {
            console.log('YouTube time successfully written!');
          })
          .catch((error) => {
            console.error(
              'Error writing YouTube time: ',
              error,
              '\n Retrying...'
            );
            if (postYouTubeTimeRetryLimit < 3) {
              postYouTubeTimeRetryLimit++;
              postYouTubeTime(time);
            } else {
              postYouTubeTimeRetryLimit = 0;
            }
          });
      }
    );
  });
}

chrome.tabs.onActivated.addListener(function (activeInfo, changeInfo, tab) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    // Throw error
    if (chrome.runtime.lastError) {
    }

    tabDataHandler(false, tabs);
  });
});
chrome.tabs.onUpdated.addListener(function (activeInfo, changeInfo, tab) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    // Throw error
    if (chrome.runtime.lastError) {
    }

    tabDataHandler(tab, false);
  });
});

function tabDataHandler(onUpdatedTabs, onActivatedTabs) {
  console.log('activated ', onActivatedTabs[0]);
  console.log('updated  ', onUpdatedTabs);

  if (onActivatedTabs) {
    if (youtubeRegex.test(onActivatedTabs[0].url)) {
      currentYouTubeURL = onActivatedTabs[0].url;

      let data = {
        YouTubeTitle: onActivatedTabs[0].title,
        YouTubeURL: onActivatedTabs[0].url,
        Date: new Date(),
      };

      host.postMessage(data);
    } else if (onActivatedTabs[0].url) {
      let data = {
        TabTitle: onActivatedTabs[0].title,
        TabURL: onActivatedTabs[0].url,
        Date: new Date(),
      };

      host.postMessage(data);
    }
  } else if (onUpdatedTabs) {
    if (youtubeRegex.test(onUpdatedTabs.url)) {
      currentYouTubeURL = onUpdatedTabs.url;

      let data = {
        YouTubeTitle: onUpdatedTabs.title,
        YouTubeURL: onUpdatedTabs.url,
        Date: new Date(),
      };

      host.postMessage(data);
    } else if (onUpdatedTabs.url) {
      let data = {
        TabTitle: onUpdatedTabs.title,
        TabURL: onUpdatedTabs.url,
        Date: new Date(),
      };

      host.postMessage(data);
    }
  }
}

// function connect() {
//   const ws = new WebSocket('ws://localhost:8080');

//   ws.addEventListener('open', () => {
//     console.log('yer');
//     console.log('sharehub extension connected');
//     ws.addEventListener('message', function (event) {
//       console.log('Message from server ', event.data);
//     });
//   });

//   ws.addEventListener('close', (event) => {
//     console.log('Extension connection closed. ' + event.reason);
//     setTimeout(function () {
//       console.log('Reconnecting');
//       connect();
//     }, 1000);
//   });

//   ws.addEventListener('error', function (event) {
//     console.log('Extension connection error: ', event);
//   });
// }

// connect();

// fetch('http://localhost:8080')
//   .then((response) => JSON.stringify(response))
//   .then((userID) => {
//     console.log(userID);
//   });
