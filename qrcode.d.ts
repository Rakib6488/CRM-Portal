declare module "qrcode" {
  export interface ToDataURLOptions {
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
    type?: string;
    width?: number;
    margin?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }

  export function toDataURL(text: string, options?: ToDataURLOptions): Promise<string>;
  export function toString(text: string, options?: any): Promise<string>;
  export function toBuffer(text: string, options?: any): Promise<Buffer>;

  const QRCode: {
    toDataURL(text: string, options?: ToDataURLOptions): Promise<string>;
    toString(text: string, options?: any): Promise<string>;
    toBuffer(text: string, options?: any): Promise<Buffer>;
  };

  export default QRCode;
}
