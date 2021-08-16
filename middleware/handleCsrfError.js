const {goPage} = require('../utils')

module.exports = [
function (err, req, res, next) {
    if (err.code !== 'EBADCSRFTOKEN') return next(err)
   
    // handle CSRF token errors here
    return goPage('error', req, res, { errorMessage: 'Invalid Csrf token' }, 403 )
  }
]