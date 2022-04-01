const Path = require('path');

const {User,UserFileRepeat} = require('../persistence/models')

const {goPage,sendConfirmEmail, sendEmailResetPassword} = require('./Root')
const {goHome} = require('./Home')




// EXPORTS:

const goProfile = async (req, res, args) => {
    const user = await User.withProfileData(req.user.id)
    user.files = user.files.concat(await UserFileRepeat.allByUserId(req.user.id))
    return goPage('profile', req, res, {...args, csrfToken: req.csrfToken(), user })
}

const login = async (req, res) => {

    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return goPage('error', req, res, { errorMessage: 'Invalid request' }, 403)
        }

        let user = await User.authenticate(username, password)
        if(user){
            console.log('returned user: ' + JSON.stringify(user))
            if(!user.confirmed)
                return goHome(req, res, {status: 'User email not confirmed'})

            res.cookie('authToken', user.authToken, { maxAge: 8320000, httpOnly: true });

            return goHome(req, res, {user})
        } else console.log('Usuário não autenticado')

    } catch (err) {
        console.log('app.post/login error ' + err)
        return goPage('error', req, res, { errorMessage: 'Invalid credentials' }, 401)
    }

}

const singup = async (req, res) => {
    try{
        if(req.user){
            return goHome(req, res, {user: req.user})
        }
        return goPage('singup', req, res, {csrfToken: req.csrfToken()})
    } catch(err){
        console.log('app.get/singup error ' + err)
        return goPage('error', req, res, { errorMessage: 'Internal error' })
    }
}

const profile = async (req, res) => {
    try{
        if(!req.user){
            return goHome(req, res, {})
        }
        return goProfile(req, res, {})
    } catch(err){
        console.log('app.get/profile error ' + err)
        return goPage('error', req, res, { errorMessage: 'Internal error' })
    }
}

const changePassword = async (req, res) => {
    try{
        const changed = await req.user.changePassword(req.body.password, req.body.newPassword)
        if(changed) 
            return goProfile(req, res, {})
        else return goHome(req, res, {status: 'Error changing user password'})
    } catch(err){
        console.log('app.post/changePassword error ' + err)
        return goPage('error', req, res, { errorMessage: 'Internal error' })
    }
}

const getLogin = (req, res) => {
    try{
        if(req.user){
            return goHome(req, res, {user: req.user})
        }
        return goPage('login', req, res, {csrfToken: req.csrfToken()})
    } catch(err){
        console.log('app.get/login error ' + err)
        return goPage('error', req, res, { errorMessage: 'Internal error' })
    }
}

const postLogout = async (req, res) => {
    try{
        const { user, cookies: { authToken: authToken } } = req
    
        if (user && authToken) {
            await User.logout(authToken);
            return goHome(req, res, {})
        }

        return goPage('error', req, res, { errorMessage: 'Invalid request' })
    } catch(err){
        console.log('app.post/logout error ' + err)
        return goPage('error', req, res, { errorMessage: 'Internal error' })
    }

  }

const postSingup = async (req, res) => {

    try {
        let user = await User.createNew(req.body.email, req.body.username, req.body.password)
        if(user){
            sendConfirmEmail(user)
            return goHome(req, res, {})

        }
        else {
            throw new Error('Error registering the new user, please contact the administration')
        }
        
    } catch(err) {
        console.log('app.post/singup error ' + err)
        return goPage('error', req, res, { errorMessage: 'Invalid credentials' })
    }

}

const postNewSingupToken = async (req, res) => {
    try{
        if(req.body.email){
            const user = await User.newConfirmToken(req.body.email)
            if(user && user.confirmToken){
                sendConfirmEmail(user)
                return goHome(req, res, {status: 'New confirmation email sent'})
            }
            else return goHome(req, res, {status: 'Error sending new confirmation email'})

        }
        else{
            res.redirect('/')
        }
    } catch(err){
        console.log('app.post/newSingupToken error ' + err)
        return goPage('error', req, res, { errorMessage: 'Internal error' })
    }

}

const getValidateSingupToken = async (req, res) => {
    try{
        if(req.query.token){
            if(await User.validateSingup(req.query.token))
                return goHome(req, res, {status: 'Token validated!'})
            else
                return goHome(req, res, {status: 'Token NOT validated!'})
        }
        else{
            res.redirect('/')
        }
            
    } catch(err){
        console.log('app.get/validateSingupToken error ' + err)
        return goPage('error', req, res, { errorMessage: 'Internal error' })
    }

}

const getNewSingupToken = async (req, res) => {
    try{
        return goPage('newToken', req, res, { csrfToken: req.csrfToken() })
    } catch(err){
        console.log('app.get/newSingupToken error ' + err)
        return goPage('error', req, res, { errorMessage: 'Internal error' })
    }
}

const getForgotPassword = (req,res) => {
    try{
        if(req.query.token){
            return goPage('forgotPassword', req, res, {csrfToken: req.csrfToken(), token: req.query.token})
        } else {
            return goPage('forgotPassword', req, res, {csrfToken: req.csrfToken()})
        }
    } catch(err){
        console.log('app.get/forgotPassword error ' + err)
        return goPage('error', req, res, { errorMessage: 'Internal error' })
    }

}

const postRequestResetPassword = async (req,res) => {
    try{
        const user = await User.resetPasswordToken(req.body.email) 
        sendEmailResetPassword(user)
        return goHome(req, res, {})
    } catch(err){
        console.log('app.post/requestResetPassword error ' + err)
        return goPage('error', req, res, { errorMessage: 'Internal error' })
    }
}

const postResetPassword = async (req,res) => {
    try{
        const user = await User.resetPassword(req.body.password, req.body.passwordResetToken)
        if(user){
            return goHome(req, res, {user})
        } else {
            return goHome(req, res, {status: 'Error reseting password'})
        }
    } catch(err){
        console.log('app.post/resetPassword error ' + err)
        return goPage('error', req, res, { errorMessage: 'Internal error' })
    }

}

const postChangeUserData = async(req, res) => {
    try{
        req.user.username = req.body.username
        req.user.email = req.body.email

        if(await User.updateData(req.user, req.body.password)){
            return res.redirect(req.header('Referer') || '/')

        }
        throw new Error("Could not update user data")
    }catch(err){
        console.log('app.post/changeUserData error ' + err)
        return goPage('error', req, res, { errorMessage: 'Error processing request' })
    }
}

const postDeleteUser = async (req, res) => {
    try{
        const { user, cookies: { authToken: authToken } } = req
    
        if (user?.id == req?.body?.id && authToken) {
            await User.logout(authToken);
            await User.remove(req.body.id, req.body.password)
        }
        if(req?.user?.adminLevel > 0){
            await User.remove(req.body.id)
        }

        return res.redirect('/')

    } catch(err){
        console.log('app.post/deleteUser error ' + err)
        return goPage('error', req, res, { errorMessage: 'Internal error' })
    }
}

const getUser = async (req, res) => {
    try{
        const user = await User.withProfileData(req.params.id)

        return goPage('user', req, res, { user })

    } catch(err){
        console.log('app.get/user/:id error ' + err)
        return goPage('error', req, res, { errorMessage: 'Internal error' })
    }


}

module.exports = {
    login, singup, profile, changePassword, getLogin, postLogout, postSingup, 
    postNewSingupToken, getValidateSingupToken, getNewSingupToken, getForgotPassword,
    postRequestResetPassword, postResetPassword, postChangeUserData, postDeleteUser, getUser,
    goProfile
}