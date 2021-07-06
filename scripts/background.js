let uid;

let [
  initStorageRetryLimit,
  postTabDataRetryLimit,
  postYouTubeDataRetryLimit,
  postYouTubeTimeRetryLimit,
] = Array(4).fill(3);

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
    uid = data;
    chrome.storage.onChanged.addListener(storageListener);
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
    .doc(uid?.replace(/['"]+/g, ''))
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
    .doc(uid?.replace(/['"]+/g, ''))
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
  chrome.tabs.executeScript(
    {
      code: 'document.getElementById("movie_player").getCurrentTime()',
    },
    (results) => {
      // let time = results && results[0];
      console.log(results);
      db.collection('Users')
        .doc(uid?.replace(/['"]+/g, ''))
        .collection('Activity')
        .doc('YouTube')
        .set({ YouTubeTime: time }, { merge: true })
        .then(function () {
          console.log('YouTube time successfully written!');
        })
        .catch(function (error) {
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
}

db.collection('Users')
  .doc(uid?.replace(/['"]+/g, ''))
  .collection('YouTubeTimeRequests')
  .onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added' || change.type === 'modified') {
        postYouTubeTime();
      }
    });
  });

chrome.tabs.onUpdated.addListener(function (activeInfo) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    // Throw error
    if (chrome.runtime.lastError) {
    }

    var activeTab = tabs[0];

    if (youtubeRegex.test(activeTab.url)) {
      let data = {
        YouTubeTitle: activeTab.title,
        YouTubeURL: activeTab.url,
        Date: new Date(),
      };

      postYouTubeData(data);
    } else {
      let data = {
        TabTitle: activeTab.title,
        TabURL: activeTab.url,
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
