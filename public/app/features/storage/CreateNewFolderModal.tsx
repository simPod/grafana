import { SubmitHandler, Validate } from 'react-hook-form';

import { Button, Field, Input, Modal } from '@grafana/ui';
import { Form } from 'app/core/components/Form/Form';

type FormModel = { folderName: string };

interface Props {
  onSubmit: SubmitHandler<FormModel>;
  onDismiss: () => void;
  validate: Validate<string, FormModel>;
}

const initialFormModel = { folderName: '' };

export function CreateNewFolderModal({ validate, onDismiss, onSubmit }: Props) {
  return (
    <Modal onDismiss={onDismiss} isOpen={true} title="New Folder">
      <Form defaultValues={initialFormModel} onSubmit={onSubmit} maxWidth={'none'}>
        {({ register, errors }) => (
          <>
            <Field
              label="Folder name"
              invalid={!!errors.folderName}
              error={errors.folderName && errors.folderName.message}
            >
              <Input
                id="folder-name-input"
                {...register('folderName', {
                  required: 'Folder name is required.',
                  validate: { validate },
                })}
              />
            </Field>

            <Modal.ButtonRow>
              <Button type="submit">Create</Button>
            </Modal.ButtonRow>
          </>
        )}
      </Form>
    </Modal>
  );
}
