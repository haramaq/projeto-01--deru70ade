/**
 * KML oficial dos vendedores (Vendedores.kml aprovado pelo owner).
 *
 * Estado atual: o arquivo NÃO está embutido nesta versão — a transferência do payload
 * binário comprimido (~33 KB base64) pelo canal de integração não garante integridade
 * byte a byte, e o KML contém contatos de vendedores (dado sensível: nunca servir em
 * URL pública). Esta versão tenta carregar de um asset same-origin (se a plataforma
 * disponibilizar o arquivo em /public futuramente, o pré-carregamento passa a funcionar
 * sem mudança de código) e, na falta, sinaliza claramente para o upload manual —
 * que permanece totalmente funcional.
 */
export const KML_ASSET_URL = `${import.meta.env.BASE_URL}vendedores.kml`

export async function decodeKmlVendedores(): Promise<string> {
  const response = await fetch(KML_ASSET_URL, { headers: { Accept: 'application/xml,text/xml' } })
  if (!response.ok) {
    throw new Error('KML_EMBUTIDO_INDISPONIVEL')
  }
  const text = await response.text()
  if (!text.trim().startsWith('<?xml')) throw new Error('KML_EMBUTIDO_INDISPONIVEL')
  return text
}
