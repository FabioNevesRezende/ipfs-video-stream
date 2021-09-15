const { body, validationResult } = require('express-validator');
const {goPage} = require('../utils')

module.exports = [
    body('fileName').exists().isLength({ max: 25 }).withMessage('Maximum size 25 chars').trim().escape(),
    body('categories').exists().isLength({ max: 1024 }).withMessage('Maximum size 1024 chars').trim().escape(),
    body('description').exists().isLength({ max: 1024 }).withMessage('Maximum size 1024 chars').trim().escape(),
    body('cid').exists().isLength({ max: 46, min: 46 }).trim().escape().withMessage('Maximum size 46 chars'),
    function(req,res,next) { 
        console.log('running middleware validate video input')
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return goPage('error', req, res, { errorMessage: 'Invalid Input' }, 400 )
        }

        next()
    }   
]