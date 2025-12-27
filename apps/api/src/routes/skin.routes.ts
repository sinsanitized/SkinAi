import { Router } from "express";
import multer from "multer";
import { skinController } from "../controllers/skin.controller";
import { validateImageUpload } from "../middleware/validation";
import { rateLimiter } from "../middleware/rateLimiter";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.get("/health", skinController.healthCheck.bind(skinController));

router.post(
  "/skin/analyze",
  rateLimiter,
  upload.single("image"),
  validateImageUpload,
  skinController.analyzeSkin.bind(skinController)
);

export default router;
