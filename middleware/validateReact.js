const { body, validationResult } = require('express-validator');

module.exports = [
    body('cid').exists().matches(/Qm[A-Za-z0-9]{44}$/).withMessage('Invalid cid'),
    body('reaction').exists().isInt({min: 0, max: 1}).escape().trim().withMessage('Invalid reaction'),
    function(req,res,next) { 
        console.log('running middleware validate react')
        const errors = validationResult(req);
        console.log(errors)
        if (!errors.isEmpty()) {
            return res.status(400).render('main', {page: 'error', params: { errorMessage: 'Invalid Input' }});
        }

        next()
    }   
]