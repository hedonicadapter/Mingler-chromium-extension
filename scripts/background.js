let uid;

let initStorageRetryLimit = 3;
let postTabDataRetryLimit = 3;

const initStorage = () => {
  try {
    await initStorageCache;
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

chrome.tabs.onActivated.addListener(function (activeInfo) {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    // Throw error
    if (chrome.runtime.lastError) {
    }

    var activeTab = tabs[0];

    let data = {
      TabTitle: activeTab.title,
      TabURL: activeTab.url,
      Date: new Date(),
    };

    postTabData(data);
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
