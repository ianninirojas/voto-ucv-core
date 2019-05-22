// modules
import { Router } from "express";

// controllers
import ElectoralEventController from "../controllers/ElectoralEventController";

// middlewares
import { checkJwt } from "../middlewares/checkJwt";
import { checkRole } from "../middlewares/checkRole";

const router = Router();

router.get("/electoral-event", ElectoralEventController.getAll);

router.get("/electoral-event/:publickey", ElectoralEventController.get);

router.post("/electoral-event", [checkJwt, checkRole(["ADMIN"])], ElectoralEventController.create);

router.get("/electoral-event/:publickey/activate", [checkJwt, checkRole(["ADMIN"])], ElectoralEventController.activate);

router.get("/electoral-event/:publickey/finish", [checkJwt, checkRole(["ADMIN"])], ElectoralEventController.finish);

router.get("/electoral-event/:publickey/totalize", [checkJwt, checkRole(["ADMIN"])], ElectoralEventController.totalize);

router.post("/electoral-event/:publickey/electoral-register", [checkJwt, checkRole(["ADMIN"])], ElectoralEventController.createElectoralRegister);

router.get("/electoral-event/:publickey/electoral-register", ElectoralEventController.getElectoralRegister);

router.get("/electoral-event/:publickey/electoral-register/:electorId", [checkJwt, checkRole(["ADMIN"])], ElectoralEventController.getElector);

router.post("/electoral-event/:publickey/electoral-register/:electorId", [checkJwt, checkRole(["ADMIN"])], ElectoralEventController.updateElector);

export default router;