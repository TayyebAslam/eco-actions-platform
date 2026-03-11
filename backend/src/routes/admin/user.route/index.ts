import express from 'express';
import { storageData } from '../../../utils/services/multer';
import { createUser, destroyUserById, getAllUsers, getUsersById, updateUser } from '../../../controller/admin/user.controller';

const router = express.Router();

const upload = storageData("users");

router.get('/', getAllUsers);
router.post('/', upload.single("profile_image"), createUser);
router.patch('/:id', upload.single("profile_image"), updateUser);
router.get('/:id', getUsersById);
router.delete('/:id', destroyUserById);

export default router;