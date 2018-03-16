'use strict';

// url: /api/auth#index or /api/auth
exports.index = async function() {
  return 'hello world!';
};

// url: /api/auth#login
exports.login = async function({ username, password }) {
  return {
    username,
    loginTime: new Date(),
  };
};

// url: /api/auth#logout
exports.logout = async function({ username }) {
  return `${username}is logout!`;
};

