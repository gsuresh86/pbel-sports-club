"use client"

import React from 'react'
import { Button } from '@/components/ui/button'
import { useConfirmDialog } from '@/components/ui/confirm-dialog'
import { useAlertDialog } from '@/components/ui/alert-dialog-component'

export function DialogExample() {
  const { confirm, ConfirmDialogComponent } = useConfirmDialog()
  const { alert, AlertDialogComponent } = useAlertDialog()

  const handleDelete = () => {
    confirm({
      title: 'Delete Item',
      description: 'Are you sure you want to delete this item? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'destructive',
      onConfirm: () => {
        // Perform delete operation
        console.log('Item deleted')
        alert({
          title: 'Success',
          description: 'Item has been deleted successfully.',
          variant: 'success'
        })
      }
    })
  }

  const handleSave = () => {
    confirm({
      title: 'Save Changes',
      description: 'Do you want to save your changes?',
      confirmText: 'Save',
      cancelText: 'Cancel',
      onConfirm: () => {
        // Perform save operation
        console.log('Changes saved')
        alert({
          title: 'Success',
          description: 'Your changes have been saved.',
          variant: 'success'
        })
      }
    })
  }

  const showError = () => {
    alert({
      title: 'Error',
      description: 'Something went wrong. Please try again.',
      variant: 'error'
    })
  }

  const showWarning = () => {
    alert({
      title: 'Warning',
      description: 'This action may have unintended consequences.',
      variant: 'warning'
    })
  }

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-2xl font-bold">Dialog Examples</h2>
      
      <div className="space-x-2">
        <Button onClick={handleDelete} variant="destructive">
          Delete Item
        </Button>
        <Button onClick={handleSave}>
          Save Changes
        </Button>
        <Button onClick={showError} variant="outline">
          Show Error
        </Button>
        <Button onClick={showWarning} variant="outline">
          Show Warning
        </Button>
      </div>

      {ConfirmDialogComponent}
      {AlertDialogComponent}
    </div>
  )
}
