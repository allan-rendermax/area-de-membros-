import { createAdminClient } from '@/lib/supabase/admin'

export async function deleteProduct(input: { id: string; storeId: string; confirmation: string }): Promise<void> {
  const { error } = await createAdminClient().rpc('delete_product_atomic', {
    p_id: input.id,
    p_store_id: input.storeId,
    p_confirmation: input.confirmation,
  })
  if (!error) return
  if (error.code === 'PGRST202' || error.code === '42883') {
    throw new Error('A exclusão ainda não está disponível. A migração de exclusão de produtos precisa ser aplicada.')
  }
  if (error.code === 'P0001') throw new Error(error.message)
  throw new Error('Não foi possível excluir o produto. Tente novamente em instantes.')
}
