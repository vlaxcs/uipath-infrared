package contracts

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/santhosh-tekuri/jsonschema/v6"
)

var Checked = []string{"infra", "candidates", "result", "rehearsal", "run"}

type Schemas struct {
	byContract map[string]*jsonschema.Schema
}

func Load(contractsDir string) (*Schemas, error) {
	compiler := jsonschema.NewCompiler()
	compiler.AssertFormat()
	schemas := &Schemas{byContract: map[string]*jsonschema.Schema{}}
	for _, contract := range Checked {
		path := filepath.Join(contractsDir, contract+".schema.json")
		document, err := readJSON(path)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", path, err)
		}
		url := "file:///" + filepath.ToSlash(contract) + ".schema.json"
		if err := compiler.AddResource(url, document); err != nil {
			return nil, fmt.Errorf("%s: %w", path, err)
		}
		schema, err := compiler.Compile(url)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", path, err)
		}
		schemas.byContract[contract] = schema
	}
	return schemas, nil
}

func (s *Schemas) Check(contract, path string) error {
	schema, known := s.byContract[contract]
	if !known {
		return fmt.Errorf("no schema for contract %s", contract)
	}
	document, err := readJSON(path)
	if err != nil {
		return err
	}
	if err := schema.Validate(document); err != nil {
		return firstError(err)
	}
	return nil
}

func readJSON(path string) (any, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	return jsonschema.UnmarshalJSON(file)
}

func firstError(err error) error {
	validation, ok := err.(*jsonschema.ValidationError)
	if !ok {
		return err
	}
	for len(validation.Causes) > 0 {
		validation = validation.Causes[0]
	}
	return errors.New(strings.TrimSpace(strings.SplitN(validation.Error(), "\n", 2)[0]))
}
