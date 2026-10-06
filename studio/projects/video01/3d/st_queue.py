import sys
sys.argv = [sys.argv[0], "queue"] + sys.argv[1:]
exec(open("story.py").read())
