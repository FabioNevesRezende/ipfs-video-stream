const { check, body, validationResult } = require('express-validator');

module.exports = [
    body('fileName').exists().isLength({ max: 25 }).withMessage('Maximum size 25 chars').trim().escape(),
    body('file').exists().withMessage('There must be a file'),
    function(req,res,next) { 
        console.log('running middleware validate video input')
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).render('main', {page: 'error', params: { errorMessage: 'Invalid Input' }});
        }
        next()
    }   
]