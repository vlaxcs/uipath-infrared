package main

import (
	"bytes"
	"net"
	"testing"
)

func TestATakenPortFailsBeforeClaimingToListen(t *testing.T) {
	taken, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer taken.Close()

	var out bytes.Buffer
	listener, err := listen(taken.Addr().String(), &out)
	if err == nil {
		listener.Close()
		t.Fatal("listened on a port another socket holds")
	}
	if out.Len() != 0 {
		t.Fatalf("printed %q for a port it never got", out.String())
	}
}

func TestAFreePortIsAnnouncedOnceBound(t *testing.T) {
	var out bytes.Buffer
	listener, err := listen("127.0.0.1:0", &out)
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()

	want := "orchestrator listening on " + listener.Addr().String() + "\n"
	if out.String() != want {
		t.Fatalf("printed %q, want %q", out.String(), want)
	}
}
