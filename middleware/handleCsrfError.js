import {goPage} from '../utils.js'

const handleCsrfError = [
function (err, req, res, next) {
    if (err.code !== 'EBADCSRFTOKEN') return next(err)
   
    // handle CSRF token errors here
    return goPage('error', req, res, { errorMessage: 'Invalid Csrf token' }, 403 )
  }
]

export default handleCsrfError