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

