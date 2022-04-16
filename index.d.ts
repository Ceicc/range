import type { IncomingMessage, ServerResponse } from "http";
import type { NextFunction } from "express";
export default range;
declare type options = {
    baseDir?: string;
    hushErrors?: boolean;
    conditional?: boolean;
    range?: boolean;
    maxAge?: number;
    etag?: boolean;
    lastModified?: boolean;
    notFound?: boolean | string;
    implicitIndex?: boolean | Array<string>;
    trailingSlash?: boolean;
};
declare function range(options?: options): (req: IncomingMessage, res: ServerResponse, next: NextFunction) => Promise<void>;
