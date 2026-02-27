import { Router, Request, Response } from 'express';
import { authorizeJWT } from "@microsoft/agents-hosting";

export function messagesRouter(adapter: any, customAgent: any, authConfig: any): Router {
    
    const router = Router();

    router.post('/messages', authorizeJWT(authConfig), async (req: Request, res: Response) => {

        try {

            await adapter.process(req, res, (context: any) => {
                console.log(`\nReceived request for conversation ${context.activity.conversation.id}`);
                return customAgent.run(context);
            });

        } catch (error) {

            console.error('Adapter process error:', error);

            if (!res.headersSent) {
                res.status(500).json({
                    error: 'Internal server error',
                    message: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
    });

    return router;
}
