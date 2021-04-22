
module.exports = [
function (err, req, res, next) {
    if (err.code !== 'EBADCSRFTOKEN') return next(err)
   
    // handle CSRF token errors here
    res.status(403).render('main', {page: 'error', params: { errorMessage: 'Invalid Csrf token' } });
  }
]