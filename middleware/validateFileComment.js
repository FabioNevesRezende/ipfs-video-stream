const { body, validationResult } = require('express-validator');
const {goPage} = require('../utils')

module.exports = [
    body('commentText').exists().trim().escape().isLength({ max: 512 }).withMessage('Maximum size 512 chars'),
    function(req,res,next) { 
        console.log('running middleware validate file comment')
        const errors = validationResult(req);
        console.log(errors)
        if (!errors.isEmpty()) {
            return goPage('error', req, res, { errorMessage: 'Invalid Input' }, 400 )
        }

        next()
    }   
]