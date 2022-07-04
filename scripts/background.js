let uid;

let [initStorageRetryLimit, postYouTubeTimeRetryLimit] = Array(4).fill(3);

// Used to target specific tab with the current youtube link
// when executing content script
let currentYouTubeURL;
const youtubeRegex =
  /(https:(.+?\.)?youtube\.com\/watch(\/[A-Za-z0-9\-\._~:\/\?#\[\]@!$&'\(\)\*\+,;\=]*)?)/;

let host = chrome.runtime.connectNative('com.samba.minglerhost');

// The only message the extension will receive from the host
// is a user ID
host.onMessage.addListener(function (msg) {
  console.log('msg from host: ', msg);
  if (msg?.YouTubeURL) {
    getYouTubeTime(msg.YouTubeURL).then((time) => {
      console.log(time);
      host.postMessage({
        ...msg,
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
  // Reload the app every 15 seconds to try to reconnect
  setTimeout(() => chrome.runtime.reload(), 15000);
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

function getYouTubeTime(YouTubeURL) {
  return new Promise((resolve, reject) => {
    try {
      let time;

      chrome.tabs.query({ url: YouTubeURL }, function (result) {
        console.log('tabs query', result);
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
        YouTubeTitle: onActivatedTabs[0].title.replace(' - YouTube', ''),
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
        YouTubeTitle: onUpdatedTabs.title.replace(' - YouTube', ''),
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
