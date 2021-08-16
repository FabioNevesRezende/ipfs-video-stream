const { body, validationResult } = require('express-validator');
const {goPage} = require('../utils')

module.exports = [
    body('cid').exists().matches(/Qm[A-Za-z0-9]{44}$/).withMessage('Invalid cid'),
    body('reaction').exists().isInt({min: 0, max: 1}).escape().trim().withMessage('Invalid reaction'),
    function(req,res,next) { 
        console.log('running middleware validate react')
        const errors = validationResult(req);
        console.log(errors)
        if (!errors.isEmpty()) {
            return goPage('error', req, res, { errorMessage: 'Invalid Input' }, 400 )
        }

        next()
    }   
]