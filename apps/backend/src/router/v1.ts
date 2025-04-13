import { Router, Request, Response } from 'express';

const v1Router = Router();

v1Router.get('/', (req: Request, res: Response) => {
    res.send('v1 router');
});

export default v1Router;

