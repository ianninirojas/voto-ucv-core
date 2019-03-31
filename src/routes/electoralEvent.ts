// modules
import { Router } from "express";

// controllers
import ElectoralEventController from "../controllers/ElectoralEventController";

// middlewares
import { checkJwt } from "../middlewares/checkJwt";
import { checkRole } from "../middlewares/checkRole";

const router = Router();

router.get("/electoral-event", ElectoralEventController.getAll);

router.post("/electoral-event", [checkJwt, checkRole(["ADMIN"])], ElectoralEventController.create);

// router.post("/electoral-event/", [checkJwt, checkRole(["ADMIN"])], ElectoralEventController.create);
router.post("/electoral-event/:publicKey/register-hash", ElectoralEventController.registerHash);

// router.post("/electoral-event/activate", [checkJwt, checkRole(["ADMIN"])], ElectoralEventController.activate);
router.post("/electoral-event/:publicKey/activate", ElectoralEventController.activate);

// router.post("/electoral-event/finish", [checkJwt, checkRole(["ADMIN"])], ElectoralEventController.finish);
router.post("/electoral-event/:publicKey/finish", ElectoralEventController.finish);

export default router;