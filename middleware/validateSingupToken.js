const { query, validationResult } = require('express-validator');
const {goPage} = require('../utils')

module.exports = [
    query('token').exists().matches(/[A-Za-z0-9]+$/).withMessage('Invalid token'),
    function(req,res,next) { 
        console.log('running middleware validate singup token')
        const errors = validationResult(req);
        console.log(errors)
        if (!errors.isEmpty()) {
            return goPage('error', req, res, { errorMessage: 'Invalid Input' }, 400 )
        }

        next()
    }   
]