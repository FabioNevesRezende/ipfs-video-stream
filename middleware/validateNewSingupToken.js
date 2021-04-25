const { body, validationResult } = require('express-validator');

module.exports = [
    body('email').exists().isEmail().normalizeEmail().trim().escape(),
    function(req,res,next) { 
        console.log('running middleware validate new singup token')
        const errors = validationResult(req);
        console.log(errors)
        if (!errors.isEmpty()) {
            return res.status(400).render('main', {page: 'error', params: { errorMessage: 'Invalid Input' }});
        }

        next()
    }   
]