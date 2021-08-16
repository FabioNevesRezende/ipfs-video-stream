const { param, validationResult } = require('express-validator');
const {goPage} = require('../utils')

module.exports = [
    param('id').exists().isInt({ min: 1, max: 1000000000 }).withMessage('Maximum user id 1000000000').trim().escape(),
    function(req,res,next) { 
        console.log('running middleware validate get user')
        const errors = validationResult(req);
        console.log(errors)
        if (!errors.isEmpty()) {
            return goPage('error', req, res, { errorMessage: 'Invalid Input' }, 400 )
        }

        next()
    }   
]