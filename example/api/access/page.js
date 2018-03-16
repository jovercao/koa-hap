'use strict';

// url: /api/access/page or /api/access/page#index
exports.index = async function() {
  return 'hello world!';
};


// url: /api/access/page#hasRight
exports.hasRight = async function({ user, page }) {
  return `${user} has open rights for  ${page}.`;
};
