import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addCategory,
  deleteCategory,
  getCategories,
  moveCategory,
  reorderCategory,
  updateCategory,
} from '@/src/api/categories'

const key = ['categories'] as const

export function useCategories() {
  return useQuery({ queryKey: key, queryFn: getCategories, staleTime: 30_000 })
}

export function useAddCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { name: string; group?: string }) => addCategory(params.name, params.group),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })
}

export function useUpdateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { name: string; updates: { newName?: string; group?: string } }) =>
      updateCategory(params.name, params.updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })
}

export function useDeleteCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => deleteCategory(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })
}

export function useReorderCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { name: string; direction: 'up' | 'down' }) =>
      reorderCategory(params.name, params.direction),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })
}

export function useMoveCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { name: string; toIndex: number }) => moveCategory(params.name, params.toIndex),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })
}
