const {File,UserFileRepeat} = require('../persistence/models')

const {goPage} = require('./Root')

const LIKE = 0
const DISLIKE = 1

// EXPORTS
const getHomepage = async (req, res) => {
    try{
        return goHome(req, res, {user: req.user})
    } catch(err){
        console.log('app.get/ error ' + err)
        return goPage('error', req, res, { errorMessage: 'Internal error' })
    }
}

const goHome = async (req, res, args) => {
    if(!args.vids){
        const vids = await File.getVideosHomePage();
        console.log('vids')
        console.log(JSON.stringify(vids))
        args.vids = vids;
    }

    return goPage('home', req, res, {...args, csrfToken: req.csrfToken() })

} 

const goWatch = async (req, res) => {
    try{
        const f = await File.getByCid(req.query.filehash)
        if(f){
            f.filereactions = await File.reactions(req.query.filehash)
            console.log('app.get/watch user: ')
            console.log(JSON.stringify(req.user))

            if(req.user){
                for(const r of f.filereactions){
                    if(r.userId === req.user.id && r.num === LIKE) 
                        req.user.liked = true
                    if(r.userId === req.user.id && r.num === DISLIKE) 
                        req.user.disliked = true
                }
            }
            const alsoPostedBy = await UserFileRepeat.allByFileCid(req.query.filehash)
            return goPage('watch', req, res, { 
                file: f,
                csrfToken: req.csrfToken(),
                user: req.user,
                alsoPostedBy
            })

        }
        return goPage('error', req, res, { errorMessage: 'File not indexed' })
        
    } catch(err){
        console.log('app.get/watch error ' + err)
        return goPage('error', req, res, { errorMessage: 'Internal error' })
    }
}

const terms = async (req, res) => {
    try{
        return goPage('terms', req, res, {})
        
    } catch(err){
        console.log('app.get/terms error ' + err)
        return goPage('error', req, res, { errorMessage: 'Internal error' })
    }
}

const about = (req, res) => {
    try{
        return goPage('about', req, res, {})
    } catch(err){
        console.log('app.get/about error ' + err)
        return goPage('error', req, res, { errorMessage: 'Internal error' })
    }
}

const noScript = (req, res) => {
    try{
        return res.status(200).render('noscript')
    } catch(err){
        console.log('app.get/noscript error ' + err)
        return goPage('error', req, res, { errorMessage: 'Internal error' })
    }
}

module.exports = {
    goHome, getHomepage, goWatch, terms, about, noScript
}