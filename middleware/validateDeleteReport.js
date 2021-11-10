const { body, validationResult } = require('express-validator');
const {goPage} = require('../utils')

module.exports = [
    body('id').exists().isInt({ min: 0, max: 9999999 }).withMessage('Maximum type is 9999999').trim().escape(),
    function(req,res,next) { 
        console.log('running middleware validate delete report ')
        const errors = validationResult(req);
        console.log(errors)
        if (!errors.isEmpty()) {
            return goPage('error', req, res, { errorMessage: 'Invalid Input' }, 400 )
        }

        next()
    }   
]