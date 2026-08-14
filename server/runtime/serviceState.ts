let acceptingTraffic = false;
let shuttingDown = false;

export const serviceState = {
  markReady() {
    if (!shuttingDown) acceptingTraffic = true;
  },
  markNotReady() {
    acceptingTraffic = false;
  },
  beginShutdown() {
    shuttingDown = true;
    acceptingTraffic = false;
  },
  get acceptingTraffic() {
    return acceptingTraffic && !shuttingDown;
  },
  get shuttingDown() {
    return shuttingDown;
  },
};
