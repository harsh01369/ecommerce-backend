import jwt from 'jsonwebtoken';

const generateToken = (id) => {
    if (!id) {
        throw new Error('User ID is required for token generation');
    }
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not defined');
    }
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

export default generateToken;