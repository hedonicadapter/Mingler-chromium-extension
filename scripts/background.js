let uid;

let [
  initStorageRetryLimit,
  postTabDataRetryLimit,
  postYouTubeDataRetryLimit,
  postYouTubeTimeRetryLimit,
] = Array(4).fill(3);

// Used to target specific tab with the current youtube link
// when executing content script
let currentYouTubeURL;

let youtubeRegex =
  /(https:(.+?\.)?youtube\.com\/watch(\/[A-Za-z0-9\-\._~:\/\?#\[\]@!$&'\(\)\*\+,;\=]*)?)/;

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

function getUserID() {
  $.ajax({
    url: 'http://localhost:8080',
    method: 'GET',
    contentType: 'text/html',
    cache: false,
  })
    .done((data) => {
      chrome.storage.sync.set({ UserID: data }, function () {
        console.log('Synced storage data set to: ', data);
      });
    })
    .fail((jqXHR, textStatus, errorThrown) => {
      console.log('Error getting user ID: ', errorThrown, '\n Retrying...');
      getUserID();
    });
}

function postTabData(data) {
  db.collection('Users')
    .doc(uid)
    .collection('Activity')
    .doc('ChromiumTab')
    .set(data)
    .then(function () {
      console.log('Tab data successfully written!');
    })
    .catch(function (error) {
      console.error('Error writing tab data: ', error, '\n Retrying...');
      if (postTabDataRetryLimit < 3) {
        postTabDataRetryLimit++;
        postTabData(data);
      } else {
        postTabDataRetryLimit = 0;
      }
    });
}

function postYouTubeData(data) {
  db.collection('Users')
    .doc(uid)
    .collection('Activity')
    .doc('YouTube')
    .set(data)
    .then(function () {
      console.log('YouTube data successfully written!');
    })
    .catch(function (error) {
      console.error('Error writing YouTube data: ', error, '\n Retrying...');
      if (postYouTubeDataRetryLimit < 3) {
        postYouTubeDataRetryLimit++;
        postYouTubeData(data);
      } else {
        postYouTubeDataRetryLimit = 0;
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

chrome.tabs.onUpdated.addListener(function (activeInfo, changeInfo, tab) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    // Throw error
    if (chrome.runtime.lastError) {
    }

    if (youtubeRegex.test(tab.url)) {
      currentYouTubeURL = tab.url;

      let data = {
        YouTubeTitle: tab.title,
        YouTubeURL: tab.url,
        Date: new Date(),
      };

      postYouTubeData(data);
    } else if (changeInfo.url) {
      let data = {
        TabTitle: tab.title,
        TabURL: tab.url,
        Date: new Date(),
      };

      postTabData(data);
    }
  });
});

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
