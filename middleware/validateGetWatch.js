const { query, validationResult } = require('express-validator');
const {goPage} = require('../utils')

module.exports = [
    query('filehash').exists().matches(/Qm[A-Za-z0-9]{44}$/).withMessage('Invalid cid'),
    function(req,res,next) { 
        console.log('running middleware handle get watch')
        const errors = validationResult(req);
        console.log(errors)
        if (!errors.isEmpty()) {
            return goPage('error', req, res, { errorMessage: 'Invalid Input' }, 400 )
        }

        next()
    }   
]