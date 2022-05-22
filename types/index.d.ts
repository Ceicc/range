import type { IncomingMessage, ServerResponse } from "http";
import type { NextFunction } from "express";
export = range;
declare type options = {
    baseDir?: string;
    hushErrors?: boolean;
    conditional?: boolean;
    range?: boolean;
    maxAge?: number | false;
    etag?: boolean;
    lastModified?: boolean;
    notFound?: boolean | string;
    implicitIndex?: boolean | Array<string>;
    trailingSlash?: boolean;
    compression?: string[] | false;
};
declare function range(options?: options): (req: IncomingMessage, res: ServerResponse, next: NextFunction) => Promise<void>;
