const { param, validationResult } = require('express-validator');

module.exports = [
    param('id').exists().isInt({ min: 1, max: 1000000000 }).withMessage('Maximum user id 1000000000').trim().escape(),
    function(req,res,next) { 
        console.log('running middleware validate get user')
        const errors = validationResult(req);
        console.log(errors)
        if (!errors.isEmpty()) {
            return res.status(400).render('main', {page: 'error', params: { errorMessage: 'Invalid Input' }});
        }

        next()
    }   
]