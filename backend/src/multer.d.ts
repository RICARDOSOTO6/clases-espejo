// multer 2.x no publica sus propios tipos y @types/multer no está instalado.
// Se declara el módulo como `any` para poder importar `diskStorage`.
declare module 'multer';
