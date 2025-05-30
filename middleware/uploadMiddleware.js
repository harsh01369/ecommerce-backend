import multer from 'multer';
import path from 'path';
import fs from 'fs';

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const productDir = path.join('uploads', req.body.serialNumber);
        if (!fs.existsSync(productDir)) fs.mkdirSync(productDir, { recursive: true });
        cb(null, productDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ storage });
export default upload;
