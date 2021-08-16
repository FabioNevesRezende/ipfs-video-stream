const { body, validationResult } = require('express-validator');
const {goPage} = require('../utils')

module.exports = [
    body('commentId').exists().isInt({min: 1, max: 2147483648}).escape().trim(),
    function(req,res,next) { 
        console.log('running middleware validate delete comment ')
        const errors = validationResult(req);
        console.log(errors)
        if (!errors.isEmpty()) {
            return goPage('error', req, res, { errorMessage: 'Invalid Input' }, 400 )
        }

        next()
    }   
]