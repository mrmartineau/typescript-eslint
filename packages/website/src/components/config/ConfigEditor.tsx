import React, { useCallback, useEffect, useReducer, useState } from 'react';
import clsx from 'clsx';
import { parse } from 'json5';

import styles from './ConfigEditor.module.css';

import Text from '../inputs/Text';
import Checkbox from '../inputs/Checkbox';
import useFocus from '../hooks/useFocus';
import Modal from '@site/src/components/modals/Modal';

export interface ConfigOptionsField {
  key: string;
  label?: string;
  defaults?: unknown[];
}

export interface ConfigOptionsType {
  heading: string;
  fields: ConfigOptionsField[];
}

export type ConfigEditorValues = Record<string, unknown>;

export interface ConfigEditorProps {
  readonly options: ConfigOptionsType[];
  readonly values: ConfigEditorValues;
  readonly isOpen: boolean;
  readonly header: string;
  readonly jsonField: string;
  readonly onClose: (config: ConfigEditorValues) => void;
}

function reducerJson(
  _state: string,
  action: string | { field: string; value: ConfigEditorValues },
): string {
  if (typeof action === 'string') {
    return action;
  } else if (action && typeof action === 'object') {
    return JSON.stringify(
      {
        [action.field]: action.value,
      },
      null,
      2,
    );
  }
  throw new Error();
}

function isRecord(data: unknown): data is Record<string, unknown> {
  return Boolean(data && typeof data === 'object');
}

function reducerObject(
  state: ConfigEditorValues,
  action:
    | { type: 'init'; config?: ConfigEditorValues }
    | {
        type: 'toggle';
        checked: boolean;
        default: unknown[] | undefined;
        name: string;
      }
    | { type: 'json'; field: string; code: string },
): ConfigEditorValues {
  switch (action.type) {
    case 'init': {
      return action.config ?? {};
    }
    case 'toggle': {
      const newState = { ...state };
      if (action.checked) {
        newState[action.name] = action.default ? action.default[0] : true;
      } else if (action.name in newState) {
        delete newState[action.name];
      }
      return newState;
    }
    case 'json': {
      try {
        const parsed: unknown = parse(action.code);
        if (isRecord(parsed)) {
          const item = parsed[action.field];
          if (item && isRecord(item)) {
            return item;
          }
        }
      } catch {
        // eslint-disable-next-line no-console
        console.error('ERROR parsing json');
      }
      return state;
    }
  }
}

function filterConfig(
  options: ConfigOptionsType[],
  filter: string,
): ConfigOptionsType[] {
  return options
    .map(group => ({
      heading: group.heading,
      fields: group.fields.filter(item => String(item.key).includes(filter)),
    }))
    .filter(group => group.fields.length > 0);
}

function isDefault(value: unknown, defaults?: unknown[]): boolean {
  return defaults ? defaults.includes(value) : value === true;
}

function ConfigEditor(props: ConfigEditorProps): JSX.Element {
  const [filter, setFilter] = useState<string>('');
  const [editJson, setEditJson] = useState<boolean>(false);
  const [config, setConfig] = useReducer(reducerObject, {});
  const [jsonCode, setJsonCode] = useReducer(reducerJson, '');
  const [filterInput, setFilterFocus] = useFocus();
  const [jsonInput, setJsonFocus] = useFocus();

  const onClose = useCallback(() => {
    if (editJson) {
      props.onClose(
        reducerObject(config, {
          type: 'json',
          field: props.jsonField,
          code: jsonCode,
        }),
      );
    } else {
      props.onClose(config);
    }
  }, [props.onClose, props.jsonField, jsonCode, config]);

  useEffect(() => {
    setConfig({ type: 'init', config: props.values });
  }, [props.values]);

  useEffect(() => {
    if (props.isOpen) {
      if (!editJson) {
        setFilterFocus();
      } else {
        setJsonFocus();
      }
    }
  }, [editJson, props.isOpen]);

  const changeEditType = useCallback(() => {
    if (editJson) {
      setConfig({ type: 'json', field: props.jsonField, code: jsonCode });
    } else {
      setJsonCode({ field: props.jsonField, value: config });
    }
    setEditJson(!editJson);
  }, [editJson, config, jsonCode, props.jsonField]);

  return (
    <Modal header={props.header} isOpen={props.isOpen} onClose={onClose}>
      <div className={styles.searchBar}>
        {!editJson && (
          <Text
            ref={filterInput}
            type="text"
            name="config-filter"
            value={filter}
            className={styles.search}
            onChange={setFilter}
          />
        )}
        <button
          className={clsx('button button--info button--sm', styles.editJson)}
          onClick={changeEditType}
        >
          {!editJson ? 'Edit JSON' : 'Edit Config'}
        </button>
      </div>
      {editJson && (
        <textarea
          // @ts-expect-error: invalid react type
          ref={jsonInput}
          name="eslint-edit-json"
          className={styles.textarea}
          value={jsonCode}
          onChange={(e): void => setJsonCode(e.target.value)}
          rows={20}
        />
      )}
      {!editJson && (
        <div className={clsx('thin-scrollbar', styles.searchResultContainer)}>
          {filterConfig(props.options, filter).map(group => (
            <div key={group.heading}>
              <h3 className={styles.searchResultGroup}>{group.heading}</h3>
              <div>
                {group.fields.map(item => (
                  <label className={styles.searchResult} key={item.key}>
                    <span>
                      <span className={styles.searchResultName}>
                        {item.key}
                      </span>
                      {item.label && <br />}
                      {item.label && <span>{item.label}</span>}
                    </span>
                    <Checkbox
                      name={`config_${item.key}`}
                      value={item.key}
                      indeterminate={
                        Boolean(config[item.key]) &&
                        !isDefault(config[item.key], item.defaults)
                      }
                      checked={Boolean(config[item.key])}
                      onChange={(checked, name): void =>
                        setConfig({
                          type: 'toggle',
                          checked,
                          default: item.defaults,
                          name,
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export default ConfigEditor;
