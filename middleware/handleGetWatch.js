const { query, validationResult } = require('express-validator');

module.exports = [
    query('filehash').exists().matches(/Qm[A-Za-z0-9]{44}$/).withMessage('Invalid cid'),
    function(req,res,next) { 
        console.log('running middleware handle get watch')
        const errors = validationResult(req);
        console.log(errors)
        if (!errors.isEmpty()) {
            return res.status(400).render('main', {page: 'error', params: { errorMessage: 'Invalid Input' }});
        }

        next()
    }   
]