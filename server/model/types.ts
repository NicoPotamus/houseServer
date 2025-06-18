/*
* Interface for the server-side types
*/

export interface User {
    id?: number;
    name: string;
    email: string;
    storage_quota: number;
    files?: any;
    created_at?: Date;
    updated_at?: Date;
}

export interface LoginRequestBody {
    username: string;
    password: string;
}

export interface MulterRequest extends Request {
    file?: Express.Multer.File;
}

export interface MachineIdentifier {
    type: 'serial' | 'mac' | 'container';
    value: string;
}

export interface TunnelResponse {
    success: boolean;
    data: {
        configYml: string;
        tunnelJsonBase64: string;
        hostname: string;
        tunnelId: string;
    };
}