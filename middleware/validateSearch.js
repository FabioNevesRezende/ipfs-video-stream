const { body, validationResult } = require('express-validator');

module.exports = [
    body('term').exists().isLength({ max: 25 }).withMessage('Maximum size 25 chars').trim().escape(),
    function(req,res,next) { 
        console.log('running middleware validate search')
        const errors = validationResult(req);
        console.log(errors)
        if (!errors.isEmpty()) {
            return res.status(400).render('main', {page: 'error', params: { errorMessage: 'Invalid Input' }});
        }

        next()
    }   
]