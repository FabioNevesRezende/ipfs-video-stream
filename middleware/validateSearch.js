const { body, validationResult } = require('express-validator');
const {goPage} = require('../utils')

module.exports = [
    body('term').exists().isLength({ max: 25 }).withMessage('Maximum size 25 chars').trim().escape(),
    function(req,res,next) { 
        console.log('running middleware validate search')
        const errors = validationResult(req);
        console.log(errors)
        if (!errors.isEmpty()) {
            return goPage('error', req, res, { errorMessage: 'Invalid Input' }, 400 )
        }

        next()
    }   
]