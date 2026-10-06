import sys
sys.argv = [sys.argv[0], "owner_out"] + sys.argv[1:]
exec(open("story.py").read())
