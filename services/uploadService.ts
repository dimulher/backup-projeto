import { supabase } from './supabase';

/**
 * Serviço de Upload para Supabase Storage
 * Gerencia upload e download de arquivos no bucket 'generations'
 */

const BUCKET_NAME = 'generations';

// Gerar nome único para arquivo
const generateFileName = (userId: string, originalName: string): string => {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const extension = originalName.split('.').pop();
    return `${userId}/${timestamp}_${randomStr}.${extension}`;
};

// Upload de arquivo para o Storage
export const uploadFile = async (
    file: File | Blob,
    userId: string,
    originalName: string = 'upload.png'
): Promise<string | null> => {
    try {
        const fileName = generateFileName(userId, originalName);

        // PRIORIZAR O TIPO DO BLOB, depois detecção por extensão
        let contentType = file.type;

        // Se o blob não tem tipo definido, detectar pela extensão
        if (!contentType || contentType === 'application/octet-stream') {
            const extension = originalName.split('.').pop()?.toLowerCase();

            if (extension === 'mp4') {
                contentType = 'video/mp4';
            } else if (extension === 'webm') {
                contentType = 'video/webm';
            } else if (extension === 'mov') {
                contentType = 'video/quicktime';
            } else if (extension === 'png') {
                contentType = 'image/png';
            } else if (extension === 'jpg' || extension === 'jpeg') {
                contentType = 'image/jpeg';
            } else if (extension === 'gif') {
                contentType = 'image/gif';
            } else if (extension === 'webp') {
                contentType = 'image/webp';
            } else {
                contentType = 'application/octet-stream';
            }
        }

        console.log(`📤 Uploading file: ${fileName}`);
        console.log(`📹 ContentType: ${contentType} (blob.type: ${file.type || 'vazio'})`);
        console.log(`📦 Tamanho: ${(file.size / 1024).toFixed(2)} KB`);

        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false,
                contentType: contentType, // USAR TIPO DETECTADO
            });

        if (error) {
            console.error('Upload error:', error);
            throw error;
        }

        // Obter URL pública
        const { data: urlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(data.path);

        console.log(`✅ File uploaded: ${urlData.publicUrl}`);
        return urlData.publicUrl;
    } catch (error) {
        console.error('Erro ao fazer upload:', error);
        return null;
    }
};

// Converter base64/blob URL para arquivo e fazer upload
export const uploadFromDataUrl = async (
    dataUrl: string,
    userId: string,
    fileName: string = 'image.png'
): Promise<string | null> => {
    try {
        console.log(`📤 [uploadFromDataUrl] Iniciando upload - userId: ${userId}, fileName: ${fileName}`);
        console.log(`📤 [uploadFromDataUrl] dataUrl type: ${dataUrl.substring(0, 50)}...`);

        let blob: Blob;
        let mimeType: string;

        // Se for blob URL, buscar o blob
        if (dataUrl.startsWith('blob:')) {
            console.log('📤 [uploadFromDataUrl] Tipo: blob URL');
            const response = await fetch(dataUrl);
            const originalBlob = await response.blob();

            // Detectar MIME type baseado na extensão do arquivo (mais confiável)
            const extension = fileName.split('.').pop()?.toLowerCase();
            if (extension === 'mp4') {
                mimeType = 'video/mp4';
            } else if (extension === 'webm') {
                mimeType = 'video/webm';
            } else if (extension === 'mov') {
                mimeType = 'video/quicktime';
            } else {
                // Para imagens, usar o tipo do blob original
                mimeType = originalBlob.type || 'application/octet-stream';
            }

            console.log(`📹 MIME type detectado: ${mimeType} (extensão: ${extension})`);
            console.log(`📦 Tamanho do arquivo: ${(originalBlob.size / 1024).toFixed(2)} KB`);

            // Recriar blob com MIME type correto
            blob = new Blob([originalBlob], { type: mimeType });
        }
        // Se for data URL (base64)
        else if (dataUrl.startsWith('data:')) {
            console.log('📤 [uploadFromDataUrl] Tipo: data URL (base64)');

            // EXTRAIR MIME TYPE DO CABEÇALHO BASE64 (ex: data:video/mp4;base64,...)
            const mimeMatch = dataUrl.match(/^data:(.*?);base64,/);
            mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
            console.log(`📹 MIME type extraído do base64: ${mimeType}`);

            // Extrair a parte base64 (após a vírgula)
            const base64Data = dataUrl.split(',')[1];
            if (!base64Data) {
                throw new Error('String base64 inválida - não encontrada vírgula separadora');
            }

            console.log(`📦 Tamanho da string base64: ${base64Data.length} caracteres`);

            // CONVERSÃO CORRETA: Base64 → ArrayBuffer → Blob
            try {
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);

                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }

                blob = new Blob([bytes.buffer], { type: mimeType });
                console.log(`✅ Blob criado com sucesso - size: ${(blob.size / 1024).toFixed(2)} KB, type: ${blob.type}`);

                if (blob.size < 1024) {
                    console.warn(`⚠️ ALERTA: Blob muito pequeno (${blob.size} bytes) - possível corrupção!`);
                }
            } catch (decodeError) {
                console.error('❌ Erro na conversão base64:', decodeError);
                throw new Error('Falha ao decodificar string base64');
            }
        } else {
            throw new Error('Formato de URL inválido - deve começar com "data:" ou "blob:"');
        }

        // ⚠️ VALIDAÇÃO DE SEGURANÇA: Detectar thumbnails mascaradas como vídeos
        const expectedExtension = fileName.split('.').pop()?.toLowerCase();

        if (expectedExtension === 'mp4' || expectedExtension === 'webm' || expectedExtension === 'mov') {
            // Esperamos um vídeo, mas vamos validar
            if (blob.type.startsWith('image/')) {
                console.error(`❌ BLOQUEADO: Tentativa de upload de imagem (${blob.type}) com extensão de vídeo (.${expectedExtension})`);
                console.error(`📦 Tamanho suspeito: ${(blob.size / 1024).toFixed(2)} KB`);
                throw new Error(`ERRO: O arquivo "${fileName}" é uma imagem (${blob.type}), não um vídeo. Você está enviando a thumbnail/poster ao invés do arquivo de vídeo original.`);
            }

            if (!blob.type.startsWith('video/')) {
                console.warn(`⚠️ AVISO: Arquivo .${expectedExtension} sem MIME type de vídeo (tipo atual: ${blob.type})`);
            }

            // Vídeos geralmente têm > 100KB. Se for menor, é suspeito
            if (blob.size < 100 * 1024) {
                console.error(`❌ BLOQUEADO: Arquivo de vídeo muito pequeno (${(blob.size / 1024).toFixed(2)} KB)`);
                throw new Error(`ERRO: O arquivo "${fileName}" é muito pequeno (${(blob.size / 1024).toFixed(2)} KB) para ser um vídeo válido. Você provavelmente está enviando a thumbnail. Por favor, envie o arquivo de vídeo original.`);
            }
        }

        // UPLOAD COM CONTENTTYPE EXPLÍCITO
        console.log(`📤 [uploadFromDataUrl] Chamando uploadFile com blob.type = ${blob.type}...`);
        const result = await uploadFile(blob, userId, fileName);

        if (result) {
            console.log(`✅ [uploadFromDataUrl] Upload concluído: ${result}`);
        } else {
            console.error(`❌ [uploadFromDataUrl] Upload retornou null`);
        }

        return result;
    } catch (error) {
        console.error('❌ [uploadFromDataUrl] Erro ao converter e fazer upload:', error);
        return null;
    }
};

// Deletar arquivo do Storage
export const deleteFile = async (filePath: string): Promise<boolean> => {
    try {
        // Extrair o path da URL pública se necessário
        let path = filePath;
        if (filePath.includes(BUCKET_NAME)) {
            path = filePath.split(`${BUCKET_NAME}/`)[1];
        }

        const { error } = await supabase.storage
            .from(BUCKET_NAME)
            .remove([path]);

        if (error) throw error;

        console.log(`🗑️ File deleted: ${path}`);
        return true;
    } catch (error) {
        console.error('Erro ao deletar arquivo:', error);
        return false;
    }
};

// Obter URL pública de um arquivo
export const getPublicUrl = (filePath: string): string => {
    const { data } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);

    return data.publicUrl;
};

// Listar arquivos de um usuário
export const listUserFiles = async (userId: string): Promise<string[]> => {
    try {
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .list(userId);

        if (error) throw error;

        return data?.map(file => `${userId}/${file.name}`) ?? [];
    } catch (error) {
        console.error('Erro ao listar arquivos:', error);
        return [];
    }
};
