/// <reference types="node" />
import type { IncomingHttpHeaders, ServerResponse } from "http";
import type { BrotliCompress, Gzip, Deflate } from "zlib";
export declare function getEtag(mtime: Date, size: number): string;
export declare function forgetAboutIt(res: ServerResponse, status: number): void;
interface getPossibleEncodingParam {
    headers: IncomingHttpHeaders;
    availableEncodings: string[];
    contentType: string;
}
export declare function getPossibleEncoding({ headers, availableEncodings, contentType }: getPossibleEncodingParam): {
    encoding: string | undefined;
    stream: null;
} | {
    encoding: string;
    stream: Gzip | Deflate | BrotliCompress | undefined;
};
export declare function hasTrailingSlash(url: string): boolean;
export {};
